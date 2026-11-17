import { UserButton } from "@clerk/nextjs";
import AdminProducts from "./AdminProducts";
import styles from "./admin.module.css";

export default function AdminPage() {
  return (
    <>
      <header className={styles.header}>
        <h1>Xmerce Admin · Products</h1>
        <UserButton />
      </header>
      <AdminProducts />
    </>
  );
}
