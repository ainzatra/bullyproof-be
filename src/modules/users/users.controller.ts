import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';

// @UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly service: UsersService) {}

    @Post()
    create(@Body() body: CreateUserDto){
        return this.service.create(body)
    }

    @Get()
    findAll(){
        return this.service.findAll()
    }

    @Get(':id')
    findOne(@Param('id') id: string){
        return this.service.findOne(id)
    }


}
