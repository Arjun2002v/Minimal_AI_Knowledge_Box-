// Read-side logic for listing saved items.

export const createItemsService = (itemsRepo) => ({
  list: () => itemsRepo.list(),
});
