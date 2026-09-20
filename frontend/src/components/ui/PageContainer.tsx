import { PageSkeleton, useMinimumLoading } from "./Skeleton";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
interface PageContainerProps{loading?:boolean;title:string;cap?:string;description?:string;actions?:ReactNode;headerContent?:ReactNode;children:ReactNode;}
export function PageContainer({loading = false,title,cap,description,actions,headerContent,children}:PageContainerProps){
  const showSkeleton = useMinimumLoading(loading);
  return <section className="mx-auto flex w-full min-w-0 max-w-360 flex-col px-3 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-7 lg:px-10 lg:pb-20 lg:pt-9 xl:px-13">
    <PageHeader title={title} cap={cap} description={description} actions={actions} content={headerContent}/>
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:gap-6">{showSkeleton ? <PageSkeleton/> : children}</div>
  </section>;
}
