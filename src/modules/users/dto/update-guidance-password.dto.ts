import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGuidancePasswordDto {
    @IsString()
    @IsNotEmpty()
    old: string;

    @IsString()
    @IsNotEmpty()
    new: string;

    @IsString()
    @IsNotEmpty()
    confirm: string;
}
