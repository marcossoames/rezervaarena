import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ImageCarousel from "@/components/ImageCarousel";

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

const ArticleManagement = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedImages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `article-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('facility-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('facility-images')
          .getPublicUrl(filePath);

        uploadedImages.push(publicUrl);
      }

      setImages([...images, ...uploadedImages]);
      toast({
        title: "Succes",
        description: `${uploadedImages.length} imagine(i) încărcată(e) cu succes`
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca imaginile",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Eroare",
        description: "Titlul și conținutul sunt obligatorii",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const articleData = {
        title: title.trim(),
        content: content.trim(),
        images,
        author_id: user.id,
        is_published: true
      };

      if (editingArticle) {
        const { error } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', editingArticle.id);

        if (error) throw error;
        
        toast({
          title: "Succes",
          description: "Articolul a fost actualizat cu succes"
        });
      } else {
        const { error } = await supabase
          .from('articles')
          .insert([articleData]);

        if (error) throw error;
        
        toast({
          title: "Succes",
          description: "Articolul a fost creat cu succes"
        });
      }

      resetForm();
      setIsDialogOpen(false);
      loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut salva articolul",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setTitle(article.title);
    setContent(article.content);
    setImages(article.images || []);
    setIsDialogOpen(true);
  };

  const handleDelete = async (articleId: string) => {
    if (!confirm('Sunteți sigur că doriți să ștergeți acest articol?')) return;

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;
      
      toast({
        title: "Succes",
        description: "Articolul a fost șters cu succes"
      });
      
      loadArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge articolul",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setImages([]);
    setEditingArticle(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Se încarcă articolele...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gestionare Articole</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adaugă Articol
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingArticle ? 'Editează Articol' : 'Adaugă Articol Nou'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titlu *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Introduceți titlul articolului"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="content">Conținut *</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Introduceți conținutul articolului"
                    rows={6}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="images">Imagini</Label>
                  <div className="mt-2">
                    <input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('images')?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Se încarcă...' : 'Încarcă Imagini'}
                    </Button>
                  </div>

                  {images.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Imagine ${index + 1}`}
                            className="w-full h-24 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit">
                    {editingArticle ? 'Actualizează' : 'Creează'} Articol
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Anulează
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nu există articole create încă.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <Card key={article.id} className="border">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {article.content}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          Creat la: {new Date(article.created_at).toLocaleDateString('ro-RO')}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(article)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {article.images && article.images.length > 0 && (
                      <div className="mt-4">
                        <ImageCarousel
                          images={article.images}
                          facilityName={article.title}
                          className="max-w-md"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ArticleManagement;