import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Instagram, Youtube } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { openExternal } from "@/utils/openExternal";
import FloatingShape from "@/components/FloatingShape";

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    items: [
      { label: "rezervaarena@gmail.com", href: "mailto:rezervaarena@gmail.com" },
      { label: "soamespaul@gmail.com", href: "mailto:soamespaul@gmail.com" },
      { label: "efleihraian@gmail.com", href: "mailto:efleihraian@gmail.com" },
    ],
  },
  {
    icon: Phone,
    title: "Telefon",
    items: [
      { label: "+40720059535", href: "tel:+40720059535" },
      { label: "+40733535450", href: "tel:+40733535450" },
    ],
  },
  {
    icon: Instagram,
    title: "Instagram",
    items: [
      { label: "@rezervaarena", action: () => openExternal("https://www.instagram.com/rezervaarena/") },
    ],
  },
  {
    icon: Youtube,
    title: "YouTube",
    items: [
      { label: "RezervaArena", action: () => openExternal("https://www.youtube.com/channel/UCnbtd7RGoe_BTRGmDcQkQew") },
    ],
  },
];

const ContactPage = () => {
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation(0.1);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="w-full pt-20 pb-16">
        <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden px-4">
          <FloatingShape />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h1 className="hero-stagger-1 text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              <span className="text-primary">Contact</span>
            </h1>
            <p className="hero-stagger-2 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Aveți întrebări? Suntem aici să vă ajutăm! Contactați-ne prin oricare dintre metodele de mai jos.
            </p>
          </div>
        </section>

        <section className="py-16 px-4" ref={cardsRef}>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {contactMethods.map((method, index) => (
                <Card
                  key={index}
                  className={`group hover-lift border-border/30 bg-card/80 backdrop-blur-sm animate-on-scroll ${cardsVisible ? 'visible' : ''} stagger-${index + 1}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                        <method.icon className="h-6 w-6 text-primary group-hover-rotate" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{method.title}</h3>
                    </div>

                    <div className="space-y-2 pl-16">
                      {method.items.map((item, i) => {
                        if ('href' in item) {
                          return (
                            <a
                              key={i}
                              href={item.href}
                              className="block text-muted-foreground hover:text-primary transition-colors duration-200 link-underline text-sm"
                            >
                              {item.label}
                            </a>
                          );
                        }
                        return (
                          <button
                            key={i}
                            onClick={item.action}
                            className="block text-muted-foreground hover:text-primary transition-colors duration-200 bg-transparent border-none cursor-pointer link-underline text-sm"
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
