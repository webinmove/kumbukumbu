const parseDuration = require('parse-duration');
const parseHeaders = require('parse-headers');
const _ = require('lodash');
const hash = require('object-hash');

let goodCodes = [
  200, // OK
  201, // Created
  202, // Accepted
  204 // No Content
];

const isGoodHttpCode = (code, validCodes) => {
  return validCodes.includes(code);
};

const cleanPath = (path) => {
  // Remove starting and trailing slashes for standarisation
  return path.replace(/\/+$/g, '');
};

const getPathConfig = (pathConfigs, path) => {
  return _.find(pathConfigs, (pathConfig) => {
    const pathRegex = RegExp(pathConfig.path);
    return pathRegex.test(path);
  });
};

module.exports.Kumbukumbu = class Kumbukumbu {
  constructor (options) {
    this.options = options;
    this.logScope = 'CACHE' || this.options.logScope;
    this.redisKeyPrefix = 'CACHE' || this.options.redisKeyPrefix;

    if (this.options.logger) {
      this.logger = this.options.logger;
    } else {
      this.logger = console;
    }

    if (!this.options.redisClient) {
      throw new Error('redisClient must be defined!');
    }

    if (typeof this.options.redisClient.get !== 'function' ||
        typeof this.options.redisClient.set !== 'function') {
      throw new Error('redisClient must be a redis client!');
    }

    if (!this.options.pathsConfig) {
      throw new Error('pathsConfig must be defined!');
    }

    if (Array.isArray(this.options.statusCodes)) {
      goodCodes = goodCodes.concat(this.options.statusCodes);
    }
  }

  async interceptor (req, res, next) {
    if (req.headers['cache-control'] === 'no-cache') {
      this.logger.debug(`${this.logScope}_CACHE_CONTROL_IS_NO_CACHE`);
      return next();
    }

    const pathConfig = getPathConfig(this.options.pathsConfig, cleanPath(req.path));

    this.logger.debug(`${this.logScope}_GET_PATH_CONFIG`, pathConfig, req.path);

    if (!pathConfig) {
      this.logger.debug(`${this.logScope}_NO_PATH_CONFIG`, {}, req.path);
      return next();
    }

    if (!_.includes(pathConfig.methods, req.method)) {
      this.logger.debug(`${this.logScope}_METHOD_NOT_IN_PATH_CONFIG`, pathConfig, req.path);
      return next();
    }

    let redisKey = `${this.redisKeyPrefix}:${cleanPath(req.path).replace(/\//g, ':')}:${req.method.toLowerCase()}`;

    if (Object.keys(req.query).length) {
      const queryHash = hash({
        query: req.query
      });

      redisKey = `${redisKey}:${queryHash}`;
    }

    if (req.method === 'POST' && Object.keys(req.body).length) {
      const bodyHash = hash({
        body: req.body
      });

      redisKey = `${redisKey}:${bodyHash}`;
    }

    this.logger.debug(`${this.logScope}_REDIS_KEY_FROM_PATH_QUERY_AND_POST`, { redisKey }, {
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body
    });

    const responseFromRedis = await this.options.redisClient.get(redisKey);

    // If not data in redis, we get the body and content-type and we will store it in redis
    if (!responseFromRedis) {
      this.logger.debug(`${this.logScope}_NO_DATA_IN_REDIS`, {}, {
        redisKey
      });

      // We set a system to intercet the response after is has been sent
      const logger = this.logger; // We store it to use it with different context
      const logScope = this.logScope; // We store it to use it with different context
      const redisClient = this.options.redisClient; // We store it to use it with different context
      const originalEnd = res.end;
      const originalWrite = res.write;
      const chunks = [];
      let isIntercepting;
      let isFirstWrite = true;

      const intercept = (rawChunk, encoding) => {
        if (isFirstWrite) {
          isFirstWrite = false;
          isIntercepting = true;
        }

        if (isIntercepting) {
          // collect all the parts of a response
          if (rawChunk) {
            let chunk = rawChunk;
            if (rawChunk !== null && !Buffer.isBuffer(chunk) && encoding !== 'buffer') {
              if (!encoding) {
                chunk = Buffer.from(rawChunk);
              } else {
                chunk = Buffer.from(rawChunk, encoding);
              }
            }
            chunks.push(chunk);
          }
        }

        return isIntercepting;
      };

      res.write = (chunk, encoding) => {
        if (!intercept(chunk, encoding)) {
          originalWrite.apply(res);
        }
      };

      res.end = async function (chunk, encoding) {
        const args = Array.prototype.slice.call(arguments);

        if (intercept(chunk, encoding)) {
          isIntercepting = false;
          const body = Buffer.concat(chunks).toString('utf-8');

          process.nextTick(async () => {
            const dataToCache = {
              contentType: parseHeaders(res._header)['content-type'],
              body
            };

            const cacheExpiration = parseDuration(pathConfig.ttl) / 1000; // The lib returns Milliseconds and Redis needs Seconds

            if (isGoodHttpCode(res.statusCode, goodCodes)) {
              logger.debug(`${logScope}_STORE_DATA_IN_REDIS`, {}, {
                dataToCache,
                redisKey,
                cacheExpiration
              });
              return redisClient.set(redisKey, JSON.stringify(dataToCache), 'EX', cacheExpiration);
            } else {
              logger.debug(`${logScope}_SKIP_STORE_DATA_IN_REDIS`, {}, {
                statusCode: res.statusCode
              });
              return true;
            }
          });
          originalEnd.apply(res, args);
        } else {
          originalEnd.apply(res, args);
        }
      };

      return next();
    }

    this.logger.debug(`${this.logScope}_SEND_DATA_FROM_REDIS`, {}, {
      responseFromRedis
    });

    const parsedResponseFromRedis = JSON.parse(responseFromRedis);
    res.setHeader('content-type', parsedResponseFromRedis.contentType);

    return res.send(parsedResponseFromRedis.body);
  }

  async clearCache () {
    await this.options.redisClient.del(`${this.redisKeyPrefix}:*`);
  }
};
