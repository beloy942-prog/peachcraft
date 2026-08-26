import { createSupabaseClient } from "./src/lib/supabase.server";

const supabase = createSupabaseClient();

async function test() {
  console.log("=== Admin Connect Test: Guest Order Visibility ===\n");

  // Test 1: Get guest orders (check if email shows "Unknown")
  console.log("Test 1: getGuestOrders - checking email visibility");
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, total_amount, shipping_address(email), user_id")
      .limit(5);

    if (error) {
      console.log("  ❌ DB error:", error.message);
    } else if (data && data.length > 0) {
      const guestOrders = data.filter(o => o.user_id === null);
      if (guestOrders.length > 0) {
        // Check if shipping_address.email is null/undefined
        const hasEmail = guestOrders.every(o => o.shipping_address && o.shipping_address.email);
        console.log(`  ${hasEmail ? "✅" : "⚠️"} Found ${guestOrders.length} guest order(s)`);
        if (!hasEmail) {
          console.log("  ⚠️ ISSUE: Guest orders have null shipping_address.email - would show as 'Unknown' in UI");
        }
        // Show first guest order's email status
        const first = guestOrders[0];
        console.log(`     Order ${first.order_number}: user_id=${first.user_id}, email="${first.shipping_address?.email || '(null/undefined)'}"`);
      } else {
        console.log("  ℹ️ No guest orders found in DB (expected if none placed yet)");
      }
    } else {
      console.log("  ℹ️ No orders found");
    }
  } catch (e) {
    console.log("  ❌ Exception:", e.message);
  }

  // Test 2: Get order details for a guest order (check customer block)
  console.log("\nTest 2: getOrderDetails - checking guest customer identity");
  try {
    // First check if there are any orders at all
    const { count, error: countError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.log("  ❌ DB error:", countError.message);
    } else if (count && count > 0) {
      // Get first order with user_id IS NULL
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, user_id, shipping_address(email), order_number")
        .is("user_id", null)
        .limit(1);

      if (ordersError) {
        console.log("  ❌ DB error:", ordersError.message);
      } else if (orders && orders.length > 0) {
        const order = orders[0];
        console.log(`  Order ${order.order_number}: user_id=${order.user_id}`);
        console.log(`  shipping_address.email: "${order.shipping_address?.email || '(null/undefined)'}"`);
        if (!order.shipping_address?.email) {
          console.log("  ⚠️ ISSUE: Guest order has no shipping_address.email - customer block would be blank in admin UI");
        }
      }
    } else {
      console.log("  ℹ️ No orders in DB - cannot test guest details");
    }
  } catch (e) {
    console.log("  ❌ Exception:", e.message);
  }

  console.log("\n=== Test Complete ===");
}

test();