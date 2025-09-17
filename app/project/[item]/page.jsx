import MainSectionPage from "./MainSectionPage";

export default async function BlogPage({ params }) {
	const { item } = params;

	return <MainSectionPage item_name={item} />;
}
