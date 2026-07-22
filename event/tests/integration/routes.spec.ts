import request from 'supertest';
import app from '../../src/app';
import * as enventController from '../../src/controllers/event.controller';
import { readConfiguration } from '../../src/utils/config.utils';

jest.mock('../../src/utils/config.utils');
describe('Testing router', () => {
  beforeEach(() => {
    (readConfiguration as jest.Mock).mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  test('Post to non existing route', async () => {
    const response = await request(app).post('/none');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: 'Path not found.',
    });
  });
  test('Post invalid body', async () => {
    const response = await request(app).post('/event').send({
      message: 'hello world',
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Bad request: Empty message data',
    });
  });
  test('Post empty body', async () => {
    const response = await request(app).post('/event');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Bad request: Wrong Pub/Sub message format',
    });
  });

  test('accepts Pub/Sub envelopes larger than the body-parser default limit', async () => {
    const postMock = jest
      .spyOn(enventController, 'post')
      .mockImplementation(async (_request, response) => {
        response.status(200).send({ status: 'forwarded' });
      });
    const data = Buffer.from(
      JSON.stringify({ value: 'x'.repeat(100_000) })
    ).toString('base64');

    const response = await request(app).post('/event').send({
      message: { data },
    });

    expect(response.status).toBe(200);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  test('preserves body-parser HTTP errors', async () => {
    const response = await request(app)
      .post('/event')
      .set('Content-Type', 'application/json')
      .send('{"message":');

    expect(response.status).toBe(400);
  });

  test('rejects Pub/Sub envelopes above the configured limit with 413', async () => {
    const data = Buffer.from(
      JSON.stringify({ value: 'x'.repeat(800_000) })
    ).toString('base64');

    const response = await request(app).post('/event').send({
      message: { data },
    });

    expect(response.status).toBe(413);
  });
});
describe('unexpected error', () => {
  let postMock: jest.SpyInstance;

  beforeEach(() => {
    // Mock the post method to throw an error
    postMock = jest.spyOn(enventController, 'post').mockImplementation(() => {
      throw new Error('Test error');
    });
    (readConfiguration as jest.Mock).mockClear();
  });

  afterEach(() => {
    // Restore the original implementation
    postMock.mockRestore();
  });
  test('should handle errors thrown by post method', async () => {
    // Call the route handler
    const response = await request(app).post('/event');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
  });
});
