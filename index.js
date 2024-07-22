import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { createSqlQueryChain } from "langchain/chains/sql_db"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as dotenv from "dotenv"
import { QuerySqlTool } from "langchain/tools/sql";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";


dotenv.config()
const datasource = new DataSource({
  type: "mysql",
  host: "localhost", // Update with your MySQL host
  port: 3306, // Default MySQL port
  username: "process.env.username", // Update with your MySQL username
  password: "process.env.password", // Update with your MySQL password
  database: "supermarket", // Update with your MySQL database name
});

const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

const llm = new ChatGoogleGenerativeAI({
    apiKey:process.env.API_KEY,
    temperature:0
})
const writeQuery = await createSqlQueryChain({
    llm,
    db,
    dialect:"mysql",
    k:50
})


const executeQuery = new QuerySqlTool(db)

const answerPrompt =
  PromptTemplate.fromTemplate(`Given the following user question, corresponding SQL query, and SQL result, answer the user question.

Question: {question}
SQL Query: {query}
SQL Result: {result}
Answer: `);

const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser())
const parseQuery = (rawQuery) => {
    // Remove the surrounding ```sql and ``` from the raw query
    return rawQuery.replace(/^```sql\s+/, '').replace(/\s+```$/, '').trim();
  };
  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
        query:writeQuery
        
    }).assign({
      result: async (i) => {
        // console.log(parseQuery(i.query))
        // console.log(parseQuery(i.query));
        return await executeQuery.invoke(parseQuery(i.query));
      },
    }),
    answerChain,
  ]);

const response = await chain.invoke({
  question:"Tell me the payments recieved by which order id and what were the order item"
})
console.log(response)