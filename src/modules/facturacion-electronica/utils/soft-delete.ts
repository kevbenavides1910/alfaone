/** Filtro Prisma estándar para excluir registros con soft delete. */
export const notDeleted = { deletedAt: null } as const;

export function withNotDeleted<T extends Record<string, unknown>>(where: T) {
  return { ...where, deletedAt: null };
}
