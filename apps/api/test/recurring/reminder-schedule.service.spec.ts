import { ReminderScheduleService } from '../../src/modules/recurring/reminder-schedule.service';

describe('ReminderScheduleService', () => {
  it('finds due reminder schedules by local day and hour', async () => {
    const service = new ReminderScheduleService();
    const schedule = await service.create({
      groupId: 'group-reminder',
      type: 'settlement_day',
      schedule: { dayOfMonth: 10, hour: 9 },
      createdBy: 'user-a'
    });

    const dueAt = new Date('2026-07-10T09:00:00');
    await expect(service.findDue(dueAt)).resolves.toEqual([
      {
        scheduleId: schedule.id,
        groupId: 'group-reminder',
        type: 'settlement_day',
        dueKey: `${schedule.id}:${dueAt.toISOString().slice(0, 13)}`,
        title: 'Settlement day',
        body: 'Balances are ready to review when convenient.'
      }
    ]);
    await expect(service.findDue(new Date('2026-07-10T10:00:00'))).resolves.toEqual([]);
  });

  it('marks fired due keys so the same hour is not returned twice', async () => {
    const service = new ReminderScheduleService();
    await service.create({
      groupId: 'group-reminder',
      type: 'recurring_expense',
      schedule: { dayOfMonth: 1, hour: 9 },
      createdBy: 'user-a'
    });

    const dueAt = new Date('2026-08-01T09:00:00');
    const first = await service.processDue(dueAt);
    expect(first).toHaveLength(1);
    await expect(service.findDue(dueAt)).resolves.toEqual([]);
  });
});
