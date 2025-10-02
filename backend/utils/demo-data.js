/**
 * Demo data for testing without scraping
 */

function getDemoScrapedContent(url) {
  const domain = new URL(url).hostname.replace('www.', '');

  // Generate realistic content based on the domain
  return {
    pages: [
      {
        url,
        title: `${domain} - Digital Agency Services`,
        metaDescription: 'Professional web development, design, and digital marketing services',
        headings: {
          h1: ['Welcome to Our Agency', 'Digital Solutions'],
          h2: ['Web Development', 'UI/UX Design', 'Digital Marketing', 'Brand Strategy'],
          h3: ['Custom Websites', 'Mobile Apps', 'E-commerce', 'SEO Services', 'Social Media'],
        },
        paragraphs: [
          'We are a full-service digital agency specializing in web development and design.',
          'Our team creates custom websites, mobile applications, and digital marketing campaigns.',
          'We offer professional web design services tailored to your business needs.',
          'Our development team uses modern technologies like React, Node.js, and Python.',
          'Digital marketing services include SEO, content marketing, and social media management.',
          'We help businesses grow online through strategic digital solutions.',
          'Our UI/UX designers create beautiful and functional user experiences.',
          'E-commerce development with Shopify, WooCommerce, and custom solutions.',
          'Brand strategy and identity design for startups and established businesses.',
          'Responsive web design that works perfectly on all devices.',
        ],
        links: ['Contact Us', 'Our Services', 'Portfolio', 'About Us', 'Blog'],
        images: ['Team working together', 'Modern office space', 'Design mockups'],
        wordCount: 150,
      },
      {
        url: `${url}/services`,
        title: `Services - ${domain}`,
        metaDescription: 'Our comprehensive digital services',
        headings: {
          h1: ['Our Services'],
          h2: ['Web Development Services', 'Design Services', 'Marketing Services'],
          h3: ['Frontend Development', 'Backend Development', 'Full Stack Development'],
        },
        paragraphs: [
          'Professional web development using the latest technologies and frameworks.',
          'Custom website design that reflects your brand identity and values.',
          'SEO optimization to improve your search engine rankings and visibility.',
          'Content creation and marketing strategies that engage your audience.',
          'E-commerce solutions with secure payment processing and inventory management.',
          'Mobile-first responsive design for optimal user experience.',
          'API development and integration with third-party services.',
        ],
        links: ['Get a Quote', 'View Portfolio', 'Case Studies'],
        images: ['Service icons', 'Project screenshots'],
        wordCount: 120,
      },
    ],
    totalWords: 270,
  };
}

module.exports = {
  getDemoScrapedContent,
};
