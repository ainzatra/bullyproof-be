import { IsNotEmpty, IsString } from "class-validator";

export class CreateReportDto {
    @IsString()
    @IsNotEmpty()
    studentId: string
    
    @IsString()
    @IsNotEmpty()
    details: string
    
    @IsString()
    @IsNotEmpty()
    feelings: string
}