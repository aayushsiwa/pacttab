export interface CsvExpenseSplit {
  username: string | null;
  owedAmount: string | number;
}

export interface CsvExpenseItem {
  id: string;
  description: string;
  amount: string | number;
  payerUsername: string;
  expenseDate: Date | string;
  splits: CsvExpenseSplit[];
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function exportExpensesToCsv(groupName: string, expenses: CsvExpenseItem[]): void {
  const headers = [
    "Date",
    "Description",
    "Total Amount (INR)",
    "Paid By",
    "Split Count",
    "Split Breakdown",
  ];

  const rows = expenses.map((exp) => {
    const dateStr = exp.expenseDate ? new Date(exp.expenseDate).toISOString().split("T")[0] : "";
    const descriptionStr = exp.description || "Expense";
    const amountStr = Number(exp.amount).toFixed(2);
    const payerStr = `@${exp.payerUsername}`;
    const splitCount = exp.splits.length;
    const splitBreakdown = exp.splits
      .map((s) => `@${s.username || "user"}: Rs.${Number(s.owedAmount).toFixed(2)}`)
      .join("; ");

    return [
      escapeCsvField(dateStr),
      escapeCsvField(descriptionStr),
      escapeCsvField(amountStr),
      escapeCsvField(payerStr),
      escapeCsvField(String(splitCount)),
      escapeCsvField(splitBreakdown),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const cleanGroupName = groupName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const today = new Date().toISOString().split("T")[0];
  const filename = `${cleanGroupName}_expenses_${today}.csv`;

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
