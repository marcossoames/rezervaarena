import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCSSOptimization } from "@/hooks/useCSSOptimization";
import ImageCarousel from "@/components/ImageCarousel";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Article {
  id: string;
  title: string;
  content: string;
  images: string[];
  author_id: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const ArticlesPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const { toast } = useToast();
  
  // Optimize CSS loading for this page
  useCSSOptimization();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error loading articles:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca articolele",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Se încarcă articolele...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Articole SportBook
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descoperiți cele mai noi articole despre sport, terenuri și evenimente din comunitatea SportBook
          </p>
        </div>

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Nu există articole încă
            </h3>
            <p className="text-muted-foreground">
              Reveniți mai târziu pentru cele mai noi articole
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <Card key={article.id} className="border-0 shadow-card bg-card/50 backdrop-blur-sm overflow-hidden group hover:shadow-lg transition-all duration-300">
                <CardHeader className="p-0">
                  {article.images && article.images.length > 0 && (
                    <div className="h-48 overflow-hidden">
                      <ImageCarousel
                        images={article.images}
                        facilityName={article.title}
                        className="h-full"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="h-4 w-4" />
                    {formatDate(article.created_at)}
                  </div>
                  
                  <CardTitle className="text-xl mb-3 group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                  
                  <p className="text-muted-foreground line-clamp-3 mb-4">
                    {article.content}
                  </p>
                  
                  <Button 
                    variant="outline" 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                    onClick={() => setSelectedArticle(article)}
                  >
                    Citește mai mult
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Load More Section (for future implementation) */}
        {articles.length > 0 && (
          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              {articles.length} articol{articles.length !== 1 ? 'e' : ''} afișat{articles.length !== 1 ? 'e' : ''}
            </p>
          </div>
        )}
      </main>

      {/* Article Modal */}
      {selectedArticle && (
        <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b pb-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold pr-8">
                  {selectedArticle.title}
                </h2>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(selectedArticle.created_at)}
              </div>
            </div>
            
            <div className="space-y-6">
              {selectedArticle.images && selectedArticle.images.length > 0 && (
                <div className="mb-6">
                  <ImageCarousel
                    images={selectedArticle.images}
                    facilityName={selectedArticle.title}
                    className="max-w-full"
                  />
                </div>
              )}
              
              <div className="prose prose-lg max-w-none">
                <div className="whitespace-pre-wrap text-base leading-relaxed">
                  {selectedArticle.content}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      <Footer />
    </div>
  );
};

export default ArticlesPage;