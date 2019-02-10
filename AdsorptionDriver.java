import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.FSDataInputStream;
import org.apache.hadoop.fs.FileStatus;
import org.apache.hadoop.fs.FileSystem;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.DoubleWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.function.PairFlatMapFunction;
import org.apache.spark.api.java.function.PairFunction;

import scala.Tuple2;


public class AdsorptionDriver {
	@SuppressWarnings("serial")
	public static void main(String[] args) throws Exception {
		//quick check
		if (args.length < 2) {
			System.err.println("Bad command-line args");
			System.exit(-1);
		}
		//switch based on keyword
		switch (args[0]) {
		case "init":
			init(args[1], args[2], args[3]);
			break;
		case "iter":
			iter(args[1], args[2], args[3]);
			break;
		case "diff":
			diff(args[1], args[2], args[3], args[4]);
			break;
		case "finish":
			finish(args[1], args[2], args[3]);
			break;
		case "composite":
			composite(args[1], args[2], args[3], args[4], args[5], args[6]);
			break;
		default:
			System.err.println("Bad command-line args");
			System.exit(-1);
		}
		System.exit(0);



		PairFunction<String, String, String> a = new PairFunction<String, String, String>(){
			private static final long serialVersionUID = 1L;

			@Override
			public Tuple2<String, String> call(String s) throws Exception {
				String[] parts = s.split(" ");
				if(parts[1] == "post") {
					return new Tuple2<String, String>(parts[2], "user " + parts[0]);
				}else {
					return new Tuple2<String, String>(parts[0], "interest " + parts[2]);
				}
			}

		};
		JavaRDD<String> lines = sc.textFile("");
		lines
		.mapToPair(a)
		.groupByKey()
		.flatMapToPair(
				new PairFlatMapFunction<Tuple2<String, Iterable<String>>, String, HashMap<String, Integer>>(){

					@Override
					public Iterable<Tuple2<String, HashMap<String, Integer>>> call(
							Tuple2<String, Iterable<String>> s) throws Exception {
						String post = s._1();
						Iterable<String> stuff = s._2();
						List<String> users = new ArrayList<String>();
						List<String> interests = new ArrayList<String>();

						Iterator<String> iter = stuff.iterator();
						while(iter.hasNext()) {
							String a = iter.next();
							if(a.startsWith("user")) {
								users.add(a.split(" ")[1]);
							}else {
								interests.add(a.split(" ")[1]);
							}
						}

						List<Tuple2<String, HashMap<String, Integer>>> mapResults = new ArrayList<>();

						for(String u : users) {
							HashMap<String, Integer> i = new HashMap<>();

							for(String inte : interests) {
								i.put(inte, 1);
							}
							mapResults.add(new Tuple2<>(u, i));
						}

						return mapResults;
					}
		})
		.groupByKey()
		.mapToPair(new PairFunction<Tuple2<String, Iterable<HashMap<String, Integer>>>, String, HashMap<String, Integer>>(){

			@Override
			public Tuple2<String, Iterable<HashMap<String, Integer>>> call(Tuple2<String, Iterable<HashMap<String, Integer>>> arg0)
					throws Exception {
				String user = arg0._1();
				Map<String, Integer> finalMap = new HashMap<>();
				Iterable<HashMap<String, Integer>> val = arg0._2();
				for(Map<String, Integer> map : val) {
					for(String s : map.keySet()) {
						if(!finalMap.containsKey(s)) {
							finalMap.put(s, 0);
						}
						finalMap.put(s, 1 + finalMap.get(s));
					}
				}
				return new Tuple2<>(user,);
			}

		});

	}

	//init method as defined in hw description
	static void init(String inputPath, String outputPath, String numReducers) throws Exception {
		deleteDirectory(outputPath);
		System.out.println("Programmed by Kieran Halloran (kieranh)");

		Configuration conf = new Configuration();
		Job job = Job.getInstance(conf, "init");
		job.setJarByClass(SocialRankDriver.class);

		job.setMapperClass(InitMapper.class);
		job.setReducerClass(InitReducer.class);

		job.setNumReduceTasks(Integer.parseInt(numReducers));

		//map and reduce have same output key and value class (Text)
		job.setOutputKeyClass(Text.class);
		job.setOutputValueClass(Text.class);

		FileInputFormat.addInputPath(job, new Path(inputPath));
		FileOutputFormat.setOutputPath(job, new Path(outputPath));

		if (!job.waitForCompletion(true)) {
			System.exit(1);
		}
	}

	//iter method as defined in hw description
	static void iter(String inputPath, String outputPath, String numReducers) throws Exception {
		deleteDirectory(outputPath);
		System.out.println("Programmed by Kieran Halloran (kieranh)");

		Configuration conf = new Configuration();
		Job job = Job.getInstance(conf, "iter");
		job.setJarByClass(SocialRankDriver.class);

		job.setNumReduceTasks(Integer.parseInt(numReducers));

		job.setMapperClass(IterMapper.class);
		job.setReducerClass(IterReducer.class);

		//map and reduce have same output key and value class (Text)
		job.setOutputKeyClass(Text.class);
		job.setOutputValueClass(Text.class);

		FileInputFormat.addInputPath(job, new Path(inputPath));
		FileOutputFormat.setOutputPath(job, new Path(outputPath));

		if (!job.waitForCompletion(true)) {
			System.exit(1);
		}
	}

	//diff method as described in hw description
	static void diff(String inputPath1, String inputPath2, String outputPath, String numReducers)
			throws Exception {
		deleteDirectory(outputPath);
		System.out.println("Programmed by Kieran Halloran (kieranh)");

		Configuration conf = new Configuration();
		Job job = Job.getInstance(conf, "diff1");
		job.setJarByClass(SocialRankDriver.class);

		job.setNumReduceTasks(Integer.parseInt(numReducers));

		job.setMapperClass(DiffMapper1.class);
		job.setReducerClass(DiffReducer1.class);

		//map and reduce have same output key and value class (Text) for diff step 1
		job.setOutputKeyClass(Text.class);
		job.setOutputValueClass(Text.class);

		FileInputFormat.addInputPath(job, new Path(inputPath1));
		FileInputFormat.addInputPath(job, new Path(inputPath2));
		//write to temporary directory
		FileOutputFormat.setOutputPath(job, new Path("interDiff"));

		//run first job
		if (!job.waitForCompletion(true)) {
			System.exit(1);
		}

		Configuration conf1 = new Configuration();
		Job job1 = Job.getInstance(conf1, "diff2");
		job1.setJarByClass(SocialRankDriver.class);

		//must use 1 reducer in order to return only 1 top result
		job1.setNumReduceTasks(1);

		job1.setMapperClass(DiffMapper2.class);
		job1.setReducerClass(DiffReducer2.class);

		//map2 outputs
		job1.setMapOutputKeyClass(DoubleWritable.class);
		job1.setMapOutputValueClass(Text.class);

		//sort descending by intermediate keys (ranks)
		job1.setSortComparatorClass(DescendingDoubleWritableComparator.class);

		//reduce2 outputs
		job1.setOutputKeyClass(DoubleWritable.class);
		job1.setOutputValueClass(Text.class);

		FileInputFormat.addInputPath(job1, new Path("interDiff"));
		FileOutputFormat.setOutputPath(job1, new Path(outputPath));

		//run second job
		if (!job1.waitForCompletion(true)) {
			System.exit(1);
		}
		//delete temporary directory
		deleteDirectory("interDiff");

	}

	//finish method as defined in hw description
	static void finish(String inputPath, String outputPath, String numReducers) throws Exception {
		deleteDirectory(outputPath);
		System.out.println("Programmed by Kieran Halloran (kieranh)");

		Configuration conf = new Configuration();
		Job job = Job.getInstance(conf, "finish");
		job.setJarByClass(SocialRankDriver.class);

		job.setMapperClass(FinishMapper.class);
		job.setReducerClass(FinishReducer.class);

		job.setNumReduceTasks(Integer.parseInt(numReducers));

		//map outputs
		job.setMapOutputKeyClass(DoubleWritable.class);
		job.setMapOutputValueClass(Text.class);

		//sort descending by intermediate keys (ranks)
		job.setSortComparatorClass(DescendingDoubleWritableComparator.class);

		//reduce outputs
		job.setOutputKeyClass(Text.class);
		job.setOutputValueClass(DoubleWritable.class);

		FileInputFormat.addInputPath(job, new Path(inputPath));
		FileOutputFormat.setOutputPath(job, new Path(outputPath));

		if (!job.waitForCompletion(true)) {
			System.exit(1);
		}

	}

	//composite function as described in hw description
	static void composite(String inputPath, String outputPath, String intermPath1,
			String intermPath2, String diffPath, String numReducers) throws Exception {

		//initialize and run 2 iterations, and calculate diff
		init(inputPath, intermPath1, numReducers);
		iter(intermPath1, intermPath2, numReducers);
		diff(intermPath1, intermPath2, diffPath, numReducers);

		//iterate until diff converges
		while (readDiffResult(diffPath) > CONVERGENCE_POINT) {
			String tempOldPath = intermPath1;
			intermPath1 = intermPath2;
			intermPath2 = tempOldPath;
			iter(intermPath1, intermPath2, numReducers);
			diff(intermPath1, intermPath2, diffPath, numReducers);
		}

		finish(intermPath2, outputPath, numReducers);
	}

	// Given an output folder, returns the first double from the first part-r-00000 file
	static double readDiffResult(String path) throws Exception
	{
		double diffnum = 0.0;
		Path diffpath = new Path(path);
		Configuration conf = new Configuration();
		FileSystem fs = FileSystem.get(URI.create(path),conf);

		if (fs.exists(diffpath)) {
			FileStatus[] ls = fs.listStatus(diffpath);
			for (FileStatus file : ls) {
				if (file.getPath().getName().startsWith("part-r-00000")) {
					FSDataInputStream diffin = fs.open(file.getPath());
					BufferedReader d = new BufferedReader(new InputStreamReader(diffin));
					String diffcontent = d.readLine();
					diffnum = Double.parseDouble(diffcontent);
					d.close();
				}
			}
		}

		fs.close();
		return diffnum;
	}

	static void deleteDirectory(String path) throws Exception {
		Path todelete = new Path(path);
		Configuration conf = new Configuration();
		FileSystem fs = FileSystem.get(URI.create(path),conf);

		if (fs.exists(todelete))
			fs.delete(todelete, true);

		fs.close();
	}

}

}
