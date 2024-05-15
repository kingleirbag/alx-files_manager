import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import { ObjectId } from 'mongodb';

/**
 * AuthController class contains methods to handle authentication-related API requests.
 */
class AuthController {
  /**
   * getConnect - Authenticates a user using Basic Authentication.
   * This method extracts the email and password from the Authorization header,
   * verifies the credentials against the database, and if valid, generates an
   * authentication token stored in Redis with a 24-hour expiration.
   *
   * @param {Object} req - The request object containing the Authorization header.
   * @param {Object} res - The response object used to send back the token or an error message.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getConnect(req, res) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Basic ')) {
      const token = authHeader.slice(6);
      const decodedCredentials = Buffer.from(token, 'base64').toString('utf-8');
      const userInfo = decodedCredentials.split(':');
      if (!userInfo || userInfo.length !== 2) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [email, password] = userInfo;
      const user = await dbClient.db.collection('users').findOne({ email: email, password: sha1(password) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      } else {
        const authToken = uuidv4();
        const authKey = `auth_${authToken}`;
        // Set the key to expire in 24 hours
        await redisClient.set(authKey, user._id.toString(), 24 * 60 * 60);
        return res.status(200).json({ token: authToken });
      }
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  /**
   * getDisconnect - Logs out a user by invalidating their authentication token.
   * This method retrieves the token from the X-Token header, checks if it exists
   * in Redis, verifies the corresponding user in the database, and if valid,
   * deletes the token from Redis.
   *
   * @param {Object} req - The request object containing the X-Token header.
   * @param {Object} res - The response object used to send back the status or an error message.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    const id = await redisClient.get(`auth_${token}`);
    if (id) {
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(id) });
      if (user) {
        await redisClient.del(`auth_${token}`);
        return res.status(204).send();
      } else {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}

export default AuthController;
