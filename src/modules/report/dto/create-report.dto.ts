import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional, IsNumber, IsBase64 } from "class-validator";
import { Type } from "class-transformer";

export class ReportFileDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsNumber()
    @Type(() => Number)
    size: number

    @IsString()
    @IsNotEmpty()
    mimeType: string

    @IsString()
    @IsNotEmpty()
    uri: string

    @IsString()
    // @IsBase64()
    @IsOptional()
    encodedFile: string
}

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

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReportFileDto)
    @IsOptional()
    files?: ReportFileDto[]
}