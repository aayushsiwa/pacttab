import { pgTable, text, varchar, timestamp, integer, numeric, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"), // "admin" | "member"
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active" | "inactive"
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("group_member_unique_idx").on(table.groupId, table.userId),
]);

export const inviteLinks = pgTable("invite_links", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const joinRequests = pgTable("join_requests", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending" | "approved" | "declined"
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("user"), // "user" | "system"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidByUserId: text("paid_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expenseDate: timestamp("expense_date", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseSplits = pgTable("expense_splits", {
  id: text("id").primaryKey(),
  expenseId: text("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  owedAmount: numeric("owed_amount", { precision: 12, scale: 2 }).notNull(),
}, (table) => [
  uniqueIndex("expense_split_unique_idx").on(table.expenseId, table.userId),
]);

export const settlements = pgTable("settlements", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  paidByUserId: text("paid_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivedByUserId: text("received_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"), // "pending" | "confirmed" | "rejected" | "cancelled"
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "cascade" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  messages: many(messages),
  paidExpenses: many(expenses),
  splits: many(expenseSplits),
  paidSettlements: many(settlements, { relationName: "payer" }),
  receivedSettlements: many(settlements, { relationName: "recipient" }),
  createdSettlements: many(settlements, { relationName: "settlementCreator" }),
  joinRequests: many(joinRequests, { relationName: "joinRequester" }),
  reviewedJoinRequests: many(joinRequests, { relationName: "joinReviewer" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  inviteLinks: many(inviteLinks),
  joinRequests: many(joinRequests),
  messages: many(messages),
  expenses: many(expenses),
  settlements: many(settlements),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const inviteLinksRelations = relations(inviteLinks, ({ one }) => ({
  group: one(groups, {
    fields: [inviteLinks.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [inviteLinks.createdBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  group: one(groups, {
    fields: [messages.groupId],
    references: [groups.id],
  }),
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  paidBy: one(users, {
    fields: [expenses.paidByUserId],
    references: [users.id],
  }),
  createdByMember: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  paidBy: one(users, {
    fields: [settlements.paidByUserId],
    references: [users.id],
    relationName: "payer",
  }),
  receivedBy: one(users, {
    fields: [settlements.receivedByUserId],
    references: [users.id],
    relationName: "recipient",
  }),
  createdBy: one(users, {
    fields: [settlements.createdByUserId],
    references: [users.id],
    relationName: "settlementCreator",
  }),
}));

export const joinRequestsRelations = relations(joinRequests, ({ one }) => ({
  group: one(groups, {
    fields: [joinRequests.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [joinRequests.userId],
    references: [users.id],
    relationName: "joinRequester",
  }),
  reviewer: one(users, {
    fields: [joinRequests.reviewedBy],
    references: [users.id],
    relationName: "joinReviewer",
  }),
}));
