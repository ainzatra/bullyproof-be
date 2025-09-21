import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    new: string;

    @IsString()
    @IsNotEmpty()
    confirm: string;
}
