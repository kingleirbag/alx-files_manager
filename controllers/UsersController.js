import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { ObjectId } from 'mongodb';
import Queue from 'bull';

/**
 * UsersController class contains methods to handle user-related API requests.
 */
class UsersController {
  /**
   * postNew - Handles user registration.
   * This method validates the request data, checks if the user already exists, hashes the password,
   * creates a new user, and adds the user to the processing queue.
   *
   * @param {Object} req - The request object containing the user data.
   * @param {Object} res - The response object used to send back the status and user metadata.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  // eslint-disable-next-line consistent-return
  static async postNew(req, res) {
    const queue = new Queue('userQueue');
    const { email, password } = req.body;

    // Validate request data
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    // Check if user already exists
    const users = await dbClient.db.collection('users');
    users.findOne({ email }, async (err, result) => {
      if (result) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash the password and create new user
      const hashedPassword = sha1(password);
      const { insertedId } = await users.insertOne({ email, password: hashedPassword });
      const user = { id: insertedId, email };

      // Add user to processing queue
      queue.add({ userId: insertedId });

      return res.status(201).json(user);
    });
  }

  /**
   * getMe - Retrieves the authenticated user's information.
   * This method authenticates the user using the provided token and returns the user data.
   *
   * @param {Object} req - The request object containing the authentication token.
   * @param {Object} res - The response object used to send back the user data.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getMe(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);

    if (id) {
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
      if (user) {
        return res.status(200).json({ id: user._id, email: user.email });
      } else {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

export default UsersController;
