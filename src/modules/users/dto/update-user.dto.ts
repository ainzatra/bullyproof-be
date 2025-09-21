import { Type } from 'class-transformer';
import {
    IsString,
    IsNotEmpty,
    IsEmail,
    IsDate,
    IsNumber,
    ValidateNested,
} from 'class-validator';
import { GuardianDto } from './guardian.dto';

export class UpdateUserDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @Type(() => Date)
    @IsDate()
    @IsNotEmpty()
    birthday: Date;

    @IsString()
    @IsNotEmpty()
    gender: string;

    @IsNumber()
    @IsNotEmpty()
    grade: number;

    @IsString()
    @IsNotEmpty()
    section: string;

    @ValidateNested()
    @Type(() => GuardianDto)
    guardian: GuardianDto;
}
