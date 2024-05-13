import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Represents a client for interacting with Redis.
 */
class RedisClient {
  /**
   * Initializes a new RedisClient instance.
   */
  constructor() {
    // Establishes connection to the Redis server
    this.client = createClient();
    // Indicates whether the client is connected to the server
    this.isConnected = true;
    
    // Listens for connection errors and updates connection status
    this.client.on('error', (err) => {
      console.error('Failed to connect to Redis server:', err.message || err.toString());
      this.isConnected = false;
    });
    
    // Listens for successful connections and updates connection status
    this.client.on('connect', () => {
      this.isConnected = true;
    });
  }

  /**
   * Checks if the client is currently connected to the Redis server.
   * @returns {boolean} True if the client is connected, otherwise false.
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Retrieves the value associated with the specified key.
   * @param {String} key - The key whose value to retrieve.
   * @returns {String | Object} The value associated with the key.
   */
  async fetch(key) {
    // Promisifies the GET operation and binds it to the client instance
    return promisify(this.client.GET).bind(this.client)(key);
  }

  /**
   * Stores a key-value pair in Redis with an expiration time.
   * @param {String} key - The key to store.
   * @param {String | Number | Boolean} value - The value to store.
   * @param {Number} duration - The expiration time in seconds.
   * @returns {Promise<void>}
   */
  async store(key, value, duration) {
    // Promisifies the SETEX operation and binds it to the client instance
    await promisify(this.client.SETEX).bind(this.client)(key, duration, value);
  }

  /**
   * Removes the value associated with the specified key.
   * @param {String} key - The key to remove.
   * @returns {Promise<void>}
   */
  async remove(key) {
    // Promisifies the DEL operation and binds it to the client instance
    await promisify(this.client.DEL).bind(this.client)(key);
  }
}

// Creates a singleton instance of the RedisClient
export const redisClient = new RedisClient();
export default redisClient;
