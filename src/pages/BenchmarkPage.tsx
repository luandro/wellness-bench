import { useState } from 'react';
import { Plus, FileJson, Leaf } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { QuestionEditor } from '@/components/questions/QuestionEditor';
import { useApp } from '@/contexts/AppContext';
import type { Question } from '@/types/benchmark';

export default function BenchmarkPage() {
  const { questions, setQuestions } = useApp();
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setIsEditorOpen(true);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsEditorOpen(true);
  };

  const handleSaveQuestion = (question: Question) => {
    const existingIndex = questions.questions.findIndex(q => q.id === question.id);
    
    if (existingIndex >= 0) {
      const updated = [...questions.questions];
      updated[existingIndex] = question;
      setQuestions({ ...questions, questions: updated });
    } else {
      setQuestions({ 
        ...questions, 
        questions: [...questions.questions, question] 
      });
    }
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions({
      ...questions,
      questions: questions.questions.filter(q => q.id !== id),
    });
  };

  const handleToggleQuestion = (id: string) => {
    setQuestions({
      ...questions,
      questions: questions.questions.map(q =>
        q.id === id ? { ...q, enabled: !q.enabled } : q
      ),
    });
  };

  const enabledCount = questions.questions.filter(q => q.enabled).length;

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Benchmark Questions"
          description="Define the questions used to evaluate AI reasoning about human and planetary well-being."
          actions={
            <Button onClick={handleAddQuestion}>
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          }
        />

        {/* Buen Vivir Info Card */}
        <Card className="card-elevated mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Buen Vivir Framework</h3>
                <p className="text-sm text-muted-foreground">
                  This benchmark uses Buen Vivir (Sumak Kawsay) as its reference lens — 
                  emphasizing collective well-being, sufficiency over growth, humans as part of nature, 
                  and plural ways of living well.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Domains Overview */}
        <div className="flex flex-wrap gap-2 mb-6">
          {questions.domains.map((domain) => {
            const count = questions.questions.filter(q => q.domain === domain).length;
            return (
              <Badge key={domain} variant="secondary" className="text-sm">
                {domain} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {questions.questions
            .sort((a, b) => a.order - b.order)
            .map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onEdit={handleEditQuestion}
                onDelete={handleDeleteQuestion}
                onToggle={handleToggleQuestion}
              />
            ))}
        </div>

        {questions.questions.length === 0 && (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                <FileJson className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">No questions yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first benchmark question to get started.
              </p>
              <Button onClick={handleAddQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer Stats */}
        {questions.questions.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <span>{enabledCount} of {questions.questions.length} questions enabled</span>
            <span>Version {questions.version}</span>
          </div>
        )}

        {/* Question Editor */}
        <QuestionEditor
          question={editingQuestion}
          open={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSaveQuestion}
        />
      </div>
    </MainLayout>
  );
}
