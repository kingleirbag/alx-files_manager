/* eslint-disable import/no-named-as-default */
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * AppController class contains methods to handle API requests
 * related to the status and statistics of the application.
 */
class AppController {
  /**
   * getStatus - Gets the status of Redis and the database.
   * This method checks if the Redis and database clients are alive
   * and responds with their statuses.
   *
   * @param {Object} req - The request object (not used in this method).
   * @param {Object} res - The response object used to send back the status.
   * @returns {Promise<void>} - A promise resolves when the response is sent.
   */
  static async getStatus(req, res) {
    const redisIsAlive = redisClient.isAlive();
    const dbIsAlive = dbClient.isAlive();
    const status = { redis: redisIsAlive, db: dbIsAlive };
    await res.status(200).json(status);
  }

  /**
   * getStats - Gets the statistics of users and files in the database.
   * This method retrieves the number of users and files from the database
   * and responds with these statistics.
   *
   * @param {Object} req - request object (not used in this method).
   * @param {Object} res - response object used to send back the statistics.
   * @returns {Promise<void>} - promise resolves when the response is sent.
   */
  static async getStats(req, res) {
    const usersCount = await dbClient.nbUsers();
    const filesCount = await dbClient.nbFiles();
    const stats = { users: usersCount, files: filesCount };
    res.status(200).json(stats);
  }
}

export default AppController;
