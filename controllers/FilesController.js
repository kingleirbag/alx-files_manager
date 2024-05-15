import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import Queue from 'bull';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

/**
 * FileController class contains methods to handle file-related API requests.
 */
class FileController {
  /**
   * postUpload - Handles file uploads.
   * This method authenticates the user, validates the request data, creates a new file or folder,
   * stores the file on the filesystem, and saves the file metadata in the database.
   *
   * @param {Object} req - The request object containing the file data.
   * @param {Object} res - The response object used to send back the status and file metadata.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async postUpload(req, res) {
    // Authenticate user
    const queue = new Queue('fileQueue');
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Validate request data
    const { name, type, data, parentId, isPublic } = req.body;
    const userId = user._id;
    const acceptedTypes = ['folder', 'file', 'image'];

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !acceptedTypes.includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
    if (parentId) {
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId), userId });
      if (!file) return res.status(400).json({ error: 'Parent not found' });
      if (file && file.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    // Prepare file data
    const fileData = {
      userId,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId ? ObjectId(parentId) : 0,
    };

    if (type === 'folder') {
      const newFile = await dbClient.db.collection('files').insertOne({ ...fileData });
      return res.status(201).json({ id: newFile.insertedId, ...fileData });
    }

    // Handle file storage
    const relativePath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(relativePath)) {
      fs.mkdirSync(relativePath);
    }
    const identity = uuidv4();
    const localPath = `${relativePath}/${identity}`;
    fs.writeFile(localPath, data, 'base64', (err) => {
      if (err) console.log(err);
    });
    const newFile = await dbClient.db.collection('files').insertOne({ ...fileData, localPath });
    res.status(201).json({ id: newFile.insertedId, ...fileData });

    // Add image processing to queue
    if (type === 'image') {
      queue.add({ userId, fileId: newFile.insertedId });
    }
  }

  /**
   * getShow - Retrieves file metadata by ID.
   * This method authenticates the user, checks file ownership, and returns the file metadata.
   *
   * @param {Object} req - The request object containing the file ID.
   * @param {Object} res - The response object used to send back the file metadata.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getShow(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id }, {
      projection: {
        id: '$_id', _id: 0, name: 1, type: 1, isPublic: 1, parentId: 1, userId: 1,
      },
    });

    if (file) return res.status(200).json(file);
    else return res.status(404).json({ error: 'Not found' });
  }

  /**
   * getIndex - Lists files for the authenticated user.
   * This method authenticates the user and retrieves files, supporting pagination.
   *
   * @param {Object} req - The request object containing query parameters.
   * @param {Object} res - The response object used to send back the list of files.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { parentId } = req.query;
    const page = req.query.page || 0;
    let filter;

    if (parentId) {
      filter = { _id: ObjectId(parentId), userId: user._id };
    } else {
      filter = { userId: user._id };
    }
    const fileCollection = await dbClient.db.collection('files');
    const result = fileCollection.aggregate([
      { $match: filter },
      { $skip: parseInt(page) * 20 },
      { $limit: 20 },
      {
        $project: {
          id: '$_id', _id: 0, userId: 1, name: 1, type: 1, isPublic: 1, parentId: 1,
        },
      },
    ]);
    const resultArray = await result.toArray();
    res.status(200).json(resultArray);
  }

  /**
   * putPublish - Publishes a file (makes it public).
   * This method authenticates the user, verifies file ownership, and updates the file to be public.
   *
   * @param {Object} req - The request object containing the file ID.
   * @param {Object} res - The response object used to send back the updated file metadata.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileCollection = await dbClient.db.collection('files');
    const fileId = req.params.id;
    const file = await fileCollection.findOne({ _id: ObjectId(fileId), userId: user._id });

    if (!file) return res.status(404).json({ error: 'Not found' });

    const query = { _id: ObjectId(fileId), userId: user._id };
    const update = { $set: { isPublic: true } };
    const options = { projection: { _id: 0, localPath: 0 } };
    const updatedFile = await fileCollection.findOneAndUpdate(query, update, options);

    return res.status(200).json({ id: file._id, ...updatedFile.value });
  }

  /**
   * putUnpublish - Unpublishes a file (makes it private).
   * This method authenticates the user, verifies file ownership, and updates the file to be private.
   *
   * @param {Object} req - The request object containing the file ID.
   * @param {Object} res - The response object used to send back the updated file metadata.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileCollection = await dbClient.db.collection('files');
    const fileId = req.params.id;
    const file = await fileCollection.findOne({ _id: ObjectId(fileId), userId: user._id });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const query = { _id: ObjectId(fileId), userId: user._id };
    const update = { $set: { isPublic: false } };
    const options = { projection: { _id: 0, localPath: 0 } };
    const updatedFile = await fileCollection.findOneAndUpdate(query, update, options);

    return res.status(200).json({ id: file._id, ...updatedFile.value });
  }

  /**
   * getFile - Retrieves the content of a file by ID.
   * This method authenticates the user (if the file is not public), verifies file ownership,
   * and returns the file content.
   *
   * @param {Object} req - The request object containing the file ID.
   * @param {Object} res - The response object used to send back the file content.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getFile(req, res) {
    const fileId = req.params.id;
    const fileCollection = dbClient.db.collection('files');
    const file = await fileCollection.findOne({ _id: ObjectId(fileId) });

    if (!file) return res.status(404).json({ error: 'Not found' });

    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
    if ((!id || !user || file.userId.toString() !== id) && !file.isPublic) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: `A folder doesn't have a content` });
    }

    const { size } = req.query;
    let fileLocalPath = file.localPath;
    if (size) {
      fileLocalPath = `${file.localPath}_${size}`;
    }

    if (!fs.existsSync(fileLocalPath)) return res.status(404).json({ error: 'Not found' });

    const data = await fs.promises.readFile(fileLocalPath);
    const headerContentType = mime.contentType(file.name);
    res.header('Content-Type', headerContentType).status(200).send(data);
  }
}

export default FileController;
