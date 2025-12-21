import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Question } from '@/types/benchmark';
import { useApp } from '@/contexts/AppContext';

interface QuestionEditorProps {
  question: Question | null;
  open: boolean;
  onClose: () => void;
  onSave: (question: Question) => void;
}

export function QuestionEditor({ question, open, onClose, onSave }: QuestionEditorProps) {
  const { questions } = useApp();
  const [formData, setFormData] = useState<Partial<Question>>({
    title: '',
    text: '',
    domain: questions.domains[0],
    enabled: true,
  });

  useEffect(() => {
    if (question) {
      setFormData(question);
    } else {
      setFormData({
        title: '',
        text: '',
        domain: questions.domains[0],
        enabled: true,
      });
    }
  }, [question, questions.domains]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newQuestion: Question = {
      id: question?.id || `q-${Date.now()}`,
      title: formData.title || '',
      text: formData.text || '',
      domain: formData.domain || questions.domains[0],
      order: question?.order || questions.questions.length + 1,
      enabled: formData.enabled ?? true,
    };
    
    onSave(newQuestion);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {question ? 'Edit Question' : 'Add Question'}
          </SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Diagnosis"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Select
              value={formData.domain}
              onValueChange={(value) => setFormData({ ...formData, domain: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questions.domains.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="text">Question Text</Label>
            <Textarea
              id="text"
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Enter the full question text..."
              rows={5}
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {question ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
