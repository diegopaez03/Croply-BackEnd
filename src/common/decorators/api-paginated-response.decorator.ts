import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedMetaDto, PaginatedResponseDto } from '../dto/pagination.dto';

/**
 * Documents a paginated 200 response whose `data` items are of type `model`.
 *
 * @example
 * ```ts
 * @Get()
 * @ApiPaginatedResponse(FarmResponseDto)
 * findAll(@Query() query: PaginationQueryDto) { ... }
 * ```
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, PaginatedMetaDto, model),
    ApiOkResponse({
      description: 'Listado paginado',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: { $ref: getSchemaPath(PaginatedMetaDto) },
            },
          },
        ],
      },
    }),
  );
}
