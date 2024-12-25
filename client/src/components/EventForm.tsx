import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema } from "@db/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// 日付入力用のインポートを削除
import { format } from "date-fns";
import { prefectures } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EventFormProps {
  defaultValues?: {
    name: string;
    prefecture: string;
    date: Date;
    website?: string;
    description?: string;
    youtubePlaylist?: string;
    coordinates?: string;
  };
  onSubmit: (data: any) => Promise<void>;
}

function roundToNearest15Min(date: Date) {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const newDate = new Date(date);
  newDate.setMinutes(roundedMinutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

export function EventForm({ defaultValues, onSubmit }: EventFormProps) {
  const form = useForm({
    resolver: zodResolver(insertEventSchema),
    defaultValues: defaultValues || {
      name: "",
      prefecture: "",
      date: roundToNearest15Min(new Date()),
      website: "",
      description: "",
      youtubePlaylist: "",
      coordinates: "",
    },
  });

  const onSubmitHandler = async (values: any) => {
    try {
      const coordinates = values.coordinates?.trim();
      const data = {
        ...values,
        coordinates: coordinates || null
      };
      await onSubmit(data);
      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
      // Handle error appropriately, e.g., display an error message to the user
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitHandler)} className="space-y-8">
        <div className="space-y-2">
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">イベント名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prefecture"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">開催都道府県</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="都道府県を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {prefectures.map((prefecture) => (
                        <SelectItem key={prefecture} value={prefecture}>
                          {prefecture}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => {
                const [inputValue, setInputValue] = useState(
                  field.value ? format(field.value, "yyyyMMdd") : ""
                );

                return (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">開催日 (YYYYMMDD)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="20250101"
                        value={inputValue}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                          setInputValue(value);
                          
                          if (value.length === 8) {
                            const year = parseInt(value.substring(0, 4));
                            const month = parseInt(value.substring(4, 6)) - 1;
                            const day = parseInt(value.substring(6, 8));
                            const date = new Date(year, month, day);
                            
                            if (!isNaN(date.getTime()) && date.getMonth() === month) {
                              field.onChange(date);
                            }
                          } else {
                            field.onChange(undefined);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">WebサイトURL（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="youtubePlaylist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">YouTubeプレイリストURL（任意）</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      {...field}
                      value={field.value || ""}
                      placeholder="https://www.youtube.com/playlist?list=..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">イベント説明（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="min-h-[100px] resize-y"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {defaultValues && (
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="coordinates"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">
                        座標（編集時のみ）
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="35.255086694192784, 139.15577749578438"
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Googleマップからコピーした座標をそのまま貼り付けできます
                      </p>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] text-primary-foreground font-semibold"
              >
                保存する
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}