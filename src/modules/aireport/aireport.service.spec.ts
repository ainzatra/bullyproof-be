import { Test, TestingModule } from '@nestjs/testing';
import { AireportService } from './aireport.service';

describe('AireportService', () => {
  let service: AireportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AireportService],
    }).compile();

    service = module.get<AireportService>(AireportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
