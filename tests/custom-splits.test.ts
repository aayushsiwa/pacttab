import {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateShareSplits,
} from "../src/lib/balances";

async function runCustomSplitsTest() {
  console.log("🚀 Testing Custom Splits Calculation Engine...\n");

  // 1. Equal splits with remainder penny resolution
  console.log("1. Testing Equal Splits with remainder penny resolution...");
  const equal3 = calculateEqualSplits(100, ["u1", "u2", "u3"]);
  const equalSum = Math.round(equal3.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  console.log("   ₹100 / 3 equal splits:", equal3.map((s) => `₹${s.owedAmount}`));
  if (equalSum !== 100 || equal3[0].owedAmount !== 33.34 || equal3[1].owedAmount !== 33.33 || equal3[2].owedAmount !== 33.33) {
    throw new Error(`Equal split remainder failed: sum=${equalSum}`);
  }
  console.log("   ✓ Equal splits correctly allocate residual penny");

  // 2. Exact Amounts
  console.log("\n2. Testing Exact Amounts Splits...");
  const exactSplits = calculateExactSplits(1500, [
    { userId: "u1", amount: 800 },
    { userId: "u2", amount: 450 },
    { userId: "u3", amount: 250 },
  ]);
  const exactSum = Math.round(exactSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  if (exactSum !== 1500) {
    throw new Error(`Exact split sum failed: sum=${exactSum}`);
  }
  console.log("   ✓ Exact splits valid sum verified: ₹1,500");

  let threwMismatch = false;
  try {
    calculateExactSplits(1500, [
      { userId: "u1", amount: 800 },
      { userId: "u2", amount: 400 }, // sum 1200 !== 1500
    ]);
  } catch (err: unknown) {
    threwMismatch = true;
    console.log("   ✓ Correctly caught mismatched sum error:", (err as Error).message);
  }
  if (!threwMismatch) throw new Error("Failed to detect exact split mismatch");

  // 3. Percentages
  console.log("\n3. Testing Percentage Splits with residual penny handling...");
  const percentSplits = calculatePercentageSplits(1000, [
    { userId: "u1", percentage: 60 },
    { userId: "u2", percentage: 25 },
    { userId: "u3", percentage: 15 },
  ]);
  const percentSum = Math.round(percentSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  if (percentSum !== 1000 || percentSplits[0].owedAmount !== 600 || percentSplits[1].owedAmount !== 250 || percentSplits[2].owedAmount !== 150) {
    throw new Error(`Percentage split failed: sum=${percentSum}`);
  }
  console.log("   ✓ 60%/25%/15% split on ₹1,000 verified: ₹600, ₹250, ₹150");

  // Percentage odd penny handling: ₹10 split 33.33%, 33.33%, 33.34%
  const oddPercentSplits = calculatePercentageSplits(10, [
    { userId: "u1", percentage: 33.33 },
    { userId: "u2", percentage: 33.33 },
    { userId: "u3", percentage: 33.34 },
  ]);
  const oddPercentSum = Math.round(oddPercentSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  if (oddPercentSum !== 10) {
    throw new Error(`Odd percentage sum failed: sum=${oddPercentSum}`);
  }
  console.log("   ✓ Odd percentage split verified: sum = ₹10.00 exactly");

  let threwBadPercent = false;
  try {
    calculatePercentageSplits(100, [
      { userId: "u1", percentage: 50 },
      { userId: "u2", percentage: 40 }, // sum 90% !== 100%
    ]);
  } catch (err: unknown) {
    threwBadPercent = true;
    console.log("   ✓ Correctly caught invalid percentage total:", (err as Error).message);
  }
  if (!threwBadPercent) throw new Error("Failed to detect invalid percentage total");

  // 4. Shares / Weights
  console.log("\n4. Testing Shares / Relative Weights Splits...");
  const shareSplits = calculateShareSplits(100, [
    { userId: "u1", shares: 2 },
    { userId: "u2", shares: 1 },
    { userId: "u3", shares: 1 },
  ]);
  const shareSum = Math.round(shareSplits.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  if (shareSum !== 100 || shareSplits[0].owedAmount !== 50 || shareSplits[1].owedAmount !== 25 || shareSplits[2].owedAmount !== 25) {
    throw new Error(`Share split failed: sum=${shareSum}`);
  }
  console.log("   ✓ 2:1:1 split on ₹100 verified: ₹50, ₹25, ₹25");

  const oddShares = calculateShareSplits(10, [
    { userId: "u1", shares: 1 },
    { userId: "u2", shares: 1 },
    { userId: "u3", shares: 1 },
  ]);
  const oddSharesSum = Math.round(oddShares.reduce((acc, s) => acc + s.owedAmount, 0) * 100) / 100;
  if (oddSharesSum !== 10) {
    throw new Error(`Odd shares sum failed: sum=${oddSharesSum}`);
  }
  console.log("   ✓ 1:1:1 split on ₹10 verified: sum = ₹10.00 exactly");

  console.log("\n🎉 ALL CUSTOM SPLITS ENGINE TESTS PASSED SUCCESSFULLY!");
}

runCustomSplitsTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
