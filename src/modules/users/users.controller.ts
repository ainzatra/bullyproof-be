import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateGuidanceDto } from './dto/update-guidance.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

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

    @Put('update-info/:id')
    updateUserInfo(@Param('id') id: string, @Body() body: UpdateUserDto) {
        return this.service.updateUserInfo(id, body);
    }

    @Put('update-password/:id')
    updateUserPassword(
        @Param('id') id: string,
        @Body() body: UpdatePasswordDto,
    ) {
        return this.service.updatePassword(id, body);
    }

    @Put('update-avatar/:id')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    updateAvatar(
        @Param('id') id: string,
        @UploadedFile() file: any,
        @Body() body,
    ) {
        console.log('Update avatar:', id, file, body);
        return this.service.updateUserAvatar(id, file);
    }
    @Put('update-guidance/:id')
    updateGuidance(@Param('id') id: string, @Body() body: UpdateGuidanceDto) {
        console.log('Updating Guidance ID:', { id, body });
        return this.service.updateGuidance(id, body);
    }

    @Put('update-guidance-password/:id')
    updateGuidancePassword(
        @Param('id') id: string,
        @Body() body: UpdatePasswordDto,
    ) {
        console.log('Updating Guidance ID:', { id, body });
        return this.service.updateGuidancePassword(id, body);
    }

    @Post('/block/:id')
    blockUser(@Param('id') id: string) {
        return this.service.blockUser(id);
    }

    @Delete('/unblock/:id')
    unblockUser(@Param('id') id: string) {
        return this.service.unblockUser(id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
