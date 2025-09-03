import { IsBoolean, IsDate, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GuardianDto } from './guardian.dto';
import { Type } from 'class-transformer';
export class UserGuardianDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsEmail()
    @IsNotEmpty()
    email: string

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
    @IsOptional()
    guardian?: GuardianDto | null

}