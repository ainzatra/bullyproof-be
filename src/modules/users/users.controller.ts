import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateGuidanceDto } from './dto/update-guidance.dto';
import { UpdateGuidancePasswordDto } from './dto/update-guidance-password.dto';

@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly service: UsersService) {}

    @Post()
    create(@Body() body: CreateUserDto) {
        return this.service.create(body);
    }

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Put('update-guidance/:id')
    updateGuidance(@Param('id') id: string, @Body() body: UpdateGuidanceDto) {
        console.log('Updating Guidance ID:', { id, body });
        return this.service.updateGuidance(id, body);
    }

    @Put('update-guidance-password/:id')
    updateGuidancePassword(
        @Param('id') id: string,
        @Body() body: UpdateGuidancePasswordDto,
    ) {
        console.log('Updating Guidance ID:', { id, body });
        return this.service.updateGuidancePassword(id, body);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
