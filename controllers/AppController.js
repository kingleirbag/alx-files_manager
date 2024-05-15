/* eslint-disable import/no-named-as-default */
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * AppController class contains methods to handle API requests
 * related to the status and statistics of the application.
 */
class AppController {
  static async getStatus(req, res) {
    const redisIsAlive = redisClient.isAlive();
    const dbIsAlive = dbClient.isAlive();
    const status = { redis: redisIsAlive, db: dbIsAlive };
    await res.status(200).json(status);
  }

  static async getStats(req, res) {
    const usersCount = await dbClient.nbUsers();
    const filesCount = await dbClient.nbFiles();
    const stats = { users: usersCount, files: filesCount };
    res.status(200).json(stats);
  }
}

export default AppController;
