import {
  createInMemoryStore,
  createInMemoryTaskRepository,
} from "./in-memory-task-repository";
import { runTaskRepositoryContract } from "./task-repository.contract";

runTaskRepositoryContract("in-memory", async () => {
  const store = createInMemoryStore();
  const repo = createInMemoryTaskRepository(store, "user-a");
  const otherUserRepo = createInMemoryTaskRepository(store, "user-b");
  return { run: (fn) => fn(repo, otherUserRepo) };
});
