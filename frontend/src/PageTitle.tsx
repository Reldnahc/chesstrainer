// Pages show no visible header; the navigation already names the page.
// The heading stays for screen readers and in-page heading navigation.
export default function PageTitle({ title }: { title: string }) {
  return <h1 className="sr-only">{title}</h1>;
}
