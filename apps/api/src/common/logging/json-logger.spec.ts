import { JsonLogger } from './json-logger';

describe('JsonLogger', () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
    jest.restoreAllMocks();
  });

  it('lọc log dưới mức LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'warn';
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = new JsonLogger();

    logger.debug('ẩn');
    logger.log('ẩn');
    expect(write).not.toHaveBeenCalled();

    logger.warn('hiện');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('ghi JSON một dòng có timestamp, level và service', () => {
    process.env.LOG_LEVEL = 'info';
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    new JsonLogger().log('xin chào', 'Test');

    const payload = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      level: 'info',
      service: 'brewlite-api',
      context: 'Test',
      message: 'xin chào',
    });
    expect(typeof payload.timestamp).toBe('string');
  });
});
