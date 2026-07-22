import * as dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import bodyParser from 'body-parser';

// Import routes
import EventRoutes from './routes/event.route';

import { readConfiguration } from './utils/config.utils';
import { errorMiddleware } from './middleware/error.middleware';
import CustomError from './errors/custom.error';

const REQUEST_BODY_LIMIT = '1mb';

// Read env variables
readConfiguration();

// Create the express app
const app: Express = express();
app.disable('x-powered-by');

// Define configurations
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));
app.use(
  bodyParser.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT })
);

// Define routes
app.use('/event', EventRoutes);
app.use('*', () => {
  throw new CustomError(404, 'Path not found.');
});

// Global error handler
app.use(errorMiddleware);

export default app;
