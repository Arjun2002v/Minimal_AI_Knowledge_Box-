export const createItemsService = (itemsRepo) => ({
  list: () => itemsRepo.list(),
});
