import { BusinessTypeGuard } from "@/components/dashboard/business-type-guard";
import RegisterPOS_V2 from "@/components/regiect";

export default function SupermarketRegisterPage() {
  return (
    <>
      <BusinessTypeGuard allow="SUPERMARKET" />
      <RegisterPOS_V2 />
    </>
  );
}
