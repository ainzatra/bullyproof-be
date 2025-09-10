import { Test, TestingModule } from '@nestjs/testing';
import { AireportController } from './aireport.controller';

describe('AireportController', () => {
  let controller: AireportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AireportController],
    }).compile();

    controller = module.get<AireportController>(AireportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
