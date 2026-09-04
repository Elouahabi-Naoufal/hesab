import { calculateSettlement } from "../src/domain/settlement";
const dh = (n:number)=>Math.round(n*100);
async function test(){
  console.log("Test unknown payer");
  let r = calculateSettlement({
    members: [{userId:"a"},{userId:"b"},{userId:"c"}],
    expenses: [{
      id:"pool",
      totalCentimes: dh(90),
      allocations: [{userId:"a",amountCentimes:dh(30)},{userId:"b",amountCentimes:dh(30)},{userId:"c",amountCentimes:dh(30)}],
      payments: []
    }]
  });
  console.log({isComplete: r.isComplete, totalUnrecorded: r.totalUnrecorded/100, balances: r.memberBalances.map(b=>b.netBalance/100), transfers: r.transfers});
  console.log("Expect isComplete false, unrecorded 90, balances -30 each, transfers 0 =>", r.isComplete===false && r.totalUnrecorded===dh(90) && r.transfers.length===0 ? "PASS":"FAIL");

  console.log("\nTest everyone pays themselves");
  r = calculateSettlement({
    members: [{userId:"a"},{userId:"b"},{userId:"c"}],
    expenses: [{
      id:"pizza",
      totalCentimes: dh(120),
      allocations: [{userId:"a",amountCentimes:dh(40)},{userId:"b",amountCentimes:dh(40)},{userId:"c",amountCentimes:dh(40)}],
      payments: [{userId:"a",amountCentimes:dh(40)},{userId:"b",amountCentimes:dh(40)},{userId:"c",amountCentimes:dh(40)}]
    }]
  });
  console.log({balances: r.memberBalances.map(b=>b.netBalance/100), transfers: r.transfers});
  console.log("Expect all 0, transfers 0 =>", r.memberBalances.every(b=>b.netBalance===0) && r.transfers.length===0 ? "PASS":"FAIL");

  console.log("\nTest one pays for everyone");
  r = calculateSettlement({
    members: [{userId:"a"},{userId:"b"},{userId:"c"}],
    expenses: [{
      id:"pizza",
      totalCentimes: dh(120),
      allocations: [{userId:"a",amountCentimes:dh(40)},{userId:"b",amountCentimes:dh(40)},{userId:"c",amountCentimes:dh(40)}],
      payments: [{userId:"a",amountCentimes:dh(120)}]
    }]
  });
  console.log({balances: r.memberBalances.map(b=>`${b.userId}:${b.netBalance/100}`), transfers: r.transfers});
  console.log("Expect a +80, b -40, c -40, 2 transfers =>", r.transfers.length===2 ? "PASS":"FAIL");

  console.log("\nTest multiple payers");
  r = calculateSettlement({
    members: [{userId:"a"},{userId:"b"},{userId:"c"}],
    expenses: [{
      id:"pizza",
      totalCentimes: dh(120),
      allocations: [{userId:"a",amountCentimes:dh(40)},{userId:"b",amountCentimes:dh(40)},{userId:"c",amountCentimes:dh(40)}],
      payments: [{userId:"a",amountCentimes:dh(80)},{userId:"b",amountCentimes:dh(40)}]
    }]
  });
  console.log({balances: r.memberBalances.map(b=>`${b.userId}:${b.netBalance/100}`), transfers: r.transfers});
  console.log("Expect a +40, b 0, c -40 =>", r.memberBalances.find(b=>b.userId==="a")!.netBalance===dh(40) && r.memberBalances.find(b=>b.userId==="c")!.netBalance===dh(-40) ? "PASS":"FAIL");
}
test();
