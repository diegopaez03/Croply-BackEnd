import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query de paginación según contrato Épica 2 (`page` / `pageSize`). */
export class PageSizePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página (base 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}

export class PageSizePaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  totalItems: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export function build_page_size_pagination(
  page: number,
  pageSize: number,
  totalItems: number,
): PageSizePaginationDto {
  const safe_page = page > 0 ? page : 1;
  const safe_size = pageSize > 0 ? pageSize : 10;
  return {
    page: safe_page,
    pageSize: safe_size,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / safe_size),
  };
}
