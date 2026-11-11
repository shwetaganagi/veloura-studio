import { Suspense } from "react";
import ProductDetailClient from "./ProductDetailClient";

type ProductPageProps = {
  params: Promise<{ productId: string }>;
};

async function ProductPageContent({ params }: ProductPageProps) {
  const { productId } = await params;
  return <ProductDetailClient productId={productId} />;
}

export default function ProductPage(props: ProductPageProps) {
  return (
    <Suspense fallback={<main className="product-detail-page">Loading this handmade treasure…</main>}>
      <ProductPageContent params={props.params} />
    </Suspense>
  );
}
