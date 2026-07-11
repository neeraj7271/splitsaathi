import {
  ActivityProjector,
  BalanceProjector,
  ExpenseProjector,
  InMemoryEventStore,
  LedgerService,
  ProjectionRunner
} from '../../src/modules/ledger';
import { BalanceQueryService } from '../../src/modules/balances';
import { ExpenseCommandService } from '../../src/modules/expenses';
import {
  SettlementCommandService,
  SettlementProjector,
  SettlementSuggestionService
} from '../../src/modules/settlements';
import {
  CsvExportService,
  ImportsExportsProjector,
  SplitwiseImportService
} from '../../src/modules/imports-exports';
import { RecurringExpenseService, RecurringProjector } from '../../src/modules/recurring';
import { OfflineCommandSyncService } from '../../src/modules/offline-sync';

export function createFinancialTestApp() {
  const eventStore = new InMemoryEventStore();
  const balanceProjector = new BalanceProjector();
  const expenseProjector = new ExpenseProjector();
  const activityProjector = new ActivityProjector();
  const settlementProjector = new SettlementProjector();
  const importsExportsProjector = new ImportsExportsProjector();
  const recurringProjector = new RecurringProjector();
  const projectionRunner = new ProjectionRunner([
    balanceProjector,
    expenseProjector,
    activityProjector,
    settlementProjector,
    importsExportsProjector,
    recurringProjector
  ]);
  const ledger = new LedgerService(eventStore, projectionRunner);
  const expenses = new ExpenseCommandService(ledger, expenseProjector);
  const balances = new BalanceQueryService(balanceProjector);
  const settlementSuggestions = new SettlementSuggestionService(balanceProjector);
  const settlements = new SettlementCommandService(ledger, settlementProjector);
  const imports = new SplitwiseImportService(ledger, importsExportsProjector, expenses);
  const exportsService = new CsvExportService(ledger, importsExportsProjector, expenseProjector, balanceProjector);
  const recurring = new RecurringExpenseService(ledger, recurringProjector, expenses);
  const offlineSync = new OfflineCommandSyncService(
    ledger,
    expenses,
    settlements,
    imports,
    exportsService,
    recurring
  );

  return {
    eventStore,
    ledger,
    projectionRunner,
    projectors: {
      balances: balanceProjector,
      expenses: expenseProjector,
      activity: activityProjector,
      settlements: settlementProjector,
      importsExports: importsExportsProjector,
      recurring: recurringProjector
    },
    services: {
      balances,
      expenses,
      settlementSuggestions,
      settlements,
      imports,
      exports: exportsService,
      recurring,
      offlineSync
    }
  };
}
