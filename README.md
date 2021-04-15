# Kumbukumbu

[![CircleCI](https://circleci.com/gh/webinmove/kumbukumbu.svg?style=svg)](https://circleci.com/gh/webinmove/kumbukumbu)
[![npm version](https://img.shields.io/npm/v/kumbukumbu.svg)](https://www.npmjs.com/package/kumbukumbu)
[![Dependency Status](https://img.shields.io/david/webinmove/kumbukumbu.svg?style=flat-square)](https://david-dm.org/webinmove/kumbukumbu)

Node.js library to use redis as cache on top of Express

## Installation

```sh
$ npm install --save kumbukumbu
```

## Usage

### Import in your project

```js
// require kumbukumbu
const { kumbukumbu } = require('kumbukumbu');
// import kumbukumbu
import { kumbukumbu } from 'kumbukumbu';
```

### Create an instance

```js
const Cache = new Kumbukumbu({
  redisClient: redisClient,
  pathsConfig: [
    {
      path: '/poney',
      ttl: '1d',
      methods: ['GET']
    }
  ]
});
```

### Example of usage

```js
const express = require('express');
const app = express();
const port = 3000;

const { Kumbukumbu } = require('@webinmove/kumbukumbu');

const redisClient = require('async-redis')
  .createClient(6379, 'localhost');

// We initialize the cache module
const Cache = new Kumbukumbu({
  redisClient: redisClient,
  pathsConfig: [
    {
      path: '/poney',
      ttl: '1d',
      methods: ['GET']
    }
  ]
});

// We check if something exists in the cache or not
// If yes, we respond with it
app.all('*', async (req, res, next) => {
  return Cache.interceptor(req, res, next);
});

// Cached
app.get('/poney', (req, res) => {
  res.json({
    poney: true
  });
});

// Not cached
app.get('/horse', (req, res) => {
  res.json({
    poney: false
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
```

## Npm scripts

### Running code formating

```sh
$ npm run format
```

### Running lint tests

```sh
$ npm test:lint
```

## Reporting bugs and contributing

If you want to report a bug or request a feature, please open an issue.
If want to help us improve kumbukumbu, fork and make a pull request.
Please use commit format as described [here](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines).
And don't forget to run `npm run format` before pushing commit.

## Repository

- [https://github.com/webinmove/kumbukumbu](https://github.com/webinmove/kumbukumbu)

## License

The MIT License (MIT)

Copyright (c) 2019 WebInMove

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
