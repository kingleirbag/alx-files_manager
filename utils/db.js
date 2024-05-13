import mongodb from 'mongodb';
// eslint-disable-next-line no-unused-vars
import Collection from 'mongodb/lib/collection';
import envLoader from './env_loader';

/**
 * Represents a client for MongoDB.
 */
class DBClient {
  /**
   * Initializes a new DBClient instance.
   */
  constructor() {
    // Load environment variables
    envLoader();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const dbURL = `mongodb://${host}:${port}/${database}`;

    // Establish connection to MongoDB server
    this.client = new mongodb.MongoClient(dbURL, { useUnifiedTopology: true });
    this.client.connect();
  }

  /**
   * Checks if the client is currently connected to the MongoDB server.
   * @returns {boolean}
   */
  isReady() {
    return this.client.isConnected();
  }

  /**
   * Retrieves the number of users stored in the database.
   * @returns {Promise<Number>}
   */
  async countUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  /**
   * Retrieves the number of files stored in the database.
   * @returns {Promise<Number>}
   */
  async countFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  /**
   * Retrieves a reference to the collection of users.
   * @returns {Promise<Collection>}
   */
  async getUsersCollection() {
    return this.client.db().collection('users');
  }

  /**
   * Retrieves a reference to the collection of files.
   * @returns {Promise<Collection>}
   */
  async getFilesCollection() {
    return this.client.db().collection('files');
  }
}

// Create a singleton instance of the DBClient
export const dbClient = new DBClient();
export default dbClient;

