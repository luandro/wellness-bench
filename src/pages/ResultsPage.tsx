import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ResultsOverview } from '@/components/results/ResultsOverview';
import { QuestionResults } from '@/components/results/QuestionResults';
import { useApp } from '@/contexts/AppContext';

export default function ResultsPage() {
  const { questions } = useApp();
  const enabledQuestions = questions.questions.filter(q => q.enabled);

  return (
    <MainLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Results"
          description="Explore evaluation results and compare model responses."
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              Overview
            </TabsTrigger>
            {enabledQuestions.map((question) => (
              <TabsTrigger
                key={question.id}
                value={question.id}
                className="data-[state=active]:bg-background"
              >
                <span className="hidden sm:inline">{question.title}</span>
                <span className="sm:hidden">Q{question.order}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <ResultsOverview />
          </TabsContent>

          {enabledQuestions.map((question) => (
            <TabsContent key={question.id} value={question.id}>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{question.domain}</Badge>
                </div>
                <h2 className="text-lg font-medium text-foreground mb-1">
                  {question.title}
                </h2>
                <p className="text-muted-foreground">{question.text}</p>
              </div>
              <QuestionResults question={question} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
