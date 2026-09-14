import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query DTO for list endpoints that support pagination.
 * Use together with {@link PaginatedResponseDto}.
 */
export class PaginationQueryDto {
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
  limit?: number = 10;
}

/**
 * Generic paginated response envelope.
 * Controllers should document the concrete `data` item type via
 * `@ApiPaginatedResponse(ItemDto)`.
 */
export class PaginatedMetaDto {
  @ApiProperty({ description: 'Página actual', example: 1 })
  page: number;

  @ApiProperty({ description: 'Elementos por página', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total de elementos', example: 42 })
  totalItems: number;

  @ApiProperty({ description: 'Total de páginas', example: 5 })
  totalPages: number;

  @ApiProperty({ description: 'Indica si existe página siguiente', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Indica si existe página anterior', example: false })
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'Elementos de la página actual' })
  data: T[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
