import { IsBoolean, IsDate, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GuardianDto } from './guardian.dto';
import { Type } from 'class-transformer';
export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string

    @IsString()
    @IsNotEmpty()
    confirm_password: string

    @Type(() => Date)
    @IsDate()
    @IsNotEmpty()
    birthday: Date

    @IsString()
    @IsNotEmpty()
    gender: string

    @IsNumber()
    @IsNotEmpty()
    grade: number

    @IsString()
    @IsNotEmpty()
    section: string

    @ValidateNested()
    @Type(() => GuardianDto)
    guardian: GuardianDto

}

